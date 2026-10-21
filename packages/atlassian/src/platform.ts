export function isCloudUrl(baseUrl: string): boolean {
  const hostname = new URL(baseUrl).hostname;
  return (
    hostname.endsWith(".atlassian.net") ||
    hostname.endsWith(".atlassian.com") ||
    hostname === "bitbucket.org" ||
    hostname.endsWith(".bitbucket.org")
  );
}
