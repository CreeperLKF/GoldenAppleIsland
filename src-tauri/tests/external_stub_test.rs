use std::net::SocketAddr;

use golden_apple_island_lib::external_approve::{self, ExternalCallError};
use golden_apple_island_lib::verdict::VerdictKind;
use golden_apple_island_lib::ws::HookEvent;

use http_body_util::Full;
use hyper::body::Bytes;
use hyper::service::service_fn;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;

fn sample_event() -> HookEvent {
    HookEvent {
        r#type: "hook_event".into(),
        id: "evt_1".into(),
        session_id: "s".into(),
        session_cwd: "/w".into(),
        source_distro: "Ubuntu".into(),
        hook_type: "pre_tool_use".into(),
        tool_name: "bash".into(),
        tool_input: serde_json::json!({ "command": "ls" }),
        timestamp: "2026-04-16T00:00:00Z".into(),
        resolved_kind: None,
        resolved_scope: None,
    }
}

async fn serve_once<F>(responder: F) -> SocketAddr
where
    F: Fn(Request<hyper::body::Incoming>) -> Response<Full<Bytes>> + Send + Sync + Clone + 'static,
{
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        loop {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);
            let r = responder.clone();
            tokio::spawn(async move {
                let _ = hyper::server::conn::http1::Builder::new()
                    .serve_connection(
                        io,
                        service_fn(move |req| {
                            let r = r.clone();
                            async move { Ok::<_, std::convert::Infallible>(r(req)) }
                        }),
                    )
                    .await;
            });
        }
    });
    addr
}

#[tokio::test]
async fn happy_approve() {
    let addr = serve_once(|_req| {
        Response::new(Full::new(Bytes::from(
            r#"{"verdict":"approve","reason":"ok"}"#,
        )))
    })
    .await;
    let url = format!("http://{}/", addr);
    let v = external_approve::run_external_call(&url, None, &sample_event(), 5)
        .await
        .unwrap();
    assert_eq!(v.verdict, VerdictKind::Approve);
}

#[tokio::test]
async fn http_500_maps_to_http_error() {
    let addr = serve_once(|_req| {
        Response::builder()
            .status(500)
            .body(Full::new(Bytes::from("boom")))
            .unwrap()
    })
    .await;
    let url = format!("http://{}/", addr);
    let err = external_approve::run_external_call(&url, None, &sample_event(), 5)
        .await
        .unwrap_err();
    assert!(matches!(err, ExternalCallError::HttpError(500, _)));
}

#[tokio::test]
async fn malformed_response_maps_to_malformed_verdict() {
    let addr = serve_once(|_req| Response::new(Full::new(Bytes::from("not json at all")))).await;
    let url = format!("http://{}/", addr);
    let err = external_approve::run_external_call(&url, None, &sample_event(), 5)
        .await
        .unwrap_err();
    assert!(matches!(err, ExternalCallError::MalformedVerdict(_)));
}
