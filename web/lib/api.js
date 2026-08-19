// Render 백엔드 전체 URL. 로컬 개발 시 .env.local의 NEXT_PUBLIC_API_BASE로 덮어쓸 수 있음
// (예: http://127.0.0.1:8000). 빌드 시점에 정적으로 치환됨(Next.js static export).
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://zone-app-9iiw.onrender.com";

export function getProfileId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("zone_profile_id");
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const profileId = getProfileId();
  if (profileId) headers["X-Profile-Id"] = profileId;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `요청 실패 (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}
