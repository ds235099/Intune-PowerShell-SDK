export async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.details = data;
    throw error;
  }
  return data;
}

export function mediaUrl(id) {
  return `/api/library/${id}/media`;
}
