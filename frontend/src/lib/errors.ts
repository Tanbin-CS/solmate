// Error helpers shared by the error boundaries.

/** A lazy page or 3D chunk that no longer exists on the server: the site was updated after this tab opened. */
export function isStaleChunk(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(error.message)
}

/** Error text for a 3D view that failed while starting. */
export function threeDFailure(error: Error): string {
  return isStaleChunk(error)
    ? 'SolMate was updated since this page opened. Reload the page to load the 3D view.'
    : 'The 3D view could not start on this device (the graphics context failed). The scores and the rest of the page still work.'
}
