// Compare logical database targets, not credentials. Test databases may share
// a server with production, but must never share the same schema/database.
export function sameDatabase(a, b) {
  if (!a || !b) return false;
  const left = new URL(a);
  const right = new URL(b);
  const port = (url) => url.port || (url.protocol === "mysql:" ? "3306" : "5432");
  return left.hostname.toLowerCase() === right.hostname.toLowerCase()
    && port(left) === port(right)
    && decodeURIComponent(left.pathname) === decodeURIComponent(right.pathname);
}
