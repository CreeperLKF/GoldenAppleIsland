/// Normalize an event's `(session_cwd, source_distro)` pair into a canonical
/// comparison key.
///
/// - Windows paths: lowercase drive letter, backslash separators, no trailing slash.
/// - WSL Linux paths: stored as `wsl://{distro}{linux_path}` so an event from
///   `source_distro=Ubuntu` with cwd `/home/x` maps to `wsl://Ubuntu/home/x`.
/// - UNC-style user input `\\wsl.localhost\Ubuntu\home\x` normalizes to the
///   same `wsl://Ubuntu/home/x` key.
pub fn normalize_event_cwd(cwd: &str, source_distro: &str) -> String {
    if source_distro.eq_ignore_ascii_case("windows") {
        return normalize_windows(cwd);
    }
    normalize_wsl(cwd, source_distro)
}

/// Normalize a user-entered folder path (from Settings). If it looks like a
/// `\\wsl.localhost\<distro>\...` UNC path the distro is extracted; otherwise
/// we assume Windows and apply Windows normalization.
pub fn normalize_user_path(input: &str) -> String {
    let trimmed = input.trim();

    // \\wsl.localhost\<distro>\<rest>   or   \\wsl$\<distro>\<rest>
    let unc = trimmed.replace('/', "\\");
    let lower = unc.to_ascii_lowercase();
    let distro_rest = if let Some(rest) = lower.strip_prefix("\\\\wsl.localhost\\") {
        Some(rest)
    } else {
        lower.strip_prefix("\\\\wsl$\\")
    };
    if let Some(rest) = distro_rest {
        let offset = unc.len() - rest.len();
        let rest_orig = &unc[offset..];
        let mut parts = rest_orig.splitn(2, '\\');
        let distro = parts.next().unwrap_or("");
        let linux_tail = parts.next().unwrap_or("");
        let linux_path = format!("/{}", linux_tail.replace('\\', "/"));
        return normalize_wsl(&linux_path, distro);
    }

    normalize_windows(trimmed)
}

fn normalize_windows(input: &str) -> String {
    let mut s = input.replace('/', "\\");
    while s.ends_with('\\') {
        s.pop();
    }
    s.to_ascii_lowercase()
}

fn normalize_wsl(linux_path: &str, distro: &str) -> String {
    let mut path = linux_path.to_string();
    while path.ends_with('/') && path.len() > 1 {
        path.pop();
    }
    if !path.starts_with('/') {
        path.insert(0, '/');
    }
    format!("wsl://{}{}", distro, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_path_lowercased_drive_backslashes_no_trailing() {
        assert_eq!(
            normalize_event_cwd("C:\\Work\\Project\\", "windows"),
            "c:\\work\\project"
        );
        assert_eq!(
            normalize_event_cwd("C:/Work/Project", "windows"),
            "c:\\work\\project"
        );
    }

    #[test]
    fn wsl_linux_path_gets_wsl_prefix() {
        assert_eq!(
            normalize_event_cwd("/home/linearkf/proj", "Ubuntu"),
            "wsl://Ubuntu/home/linearkf/proj"
        );
    }

    #[test]
    fn wsl_linux_trailing_slash_stripped() {
        assert_eq!(
            normalize_event_cwd("/home/linearkf/proj/", "Ubuntu"),
            "wsl://Ubuntu/home/linearkf/proj"
        );
    }

    #[test]
    fn unknown_distro_preserves_linux_path_under_unknown_bucket() {
        assert_eq!(
            normalize_event_cwd("/home/x", "unknown"),
            "wsl://unknown/home/x"
        );
    }

    #[test]
    fn user_unc_wsl_path_equals_event_form() {
        let event = normalize_event_cwd("/home/linearkf/proj", "Ubuntu");
        let user = normalize_user_path("\\\\wsl.localhost\\Ubuntu\\home\\linearkf\\proj");
        assert_eq!(event, user);
    }

    #[test]
    fn user_windows_path_normalizes_like_event() {
        let event = normalize_event_cwd("C:\\Work\\Project", "windows");
        let user = normalize_user_path("C:/Work/Project/");
        assert_eq!(event, user);
    }
}
