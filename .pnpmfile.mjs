function readPackage(pkg) {
  if (pkg.name === '@inkpi/client' && pkg.dependencies?.['@inkpi/protocol'] === 'workspace:*') {
    pkg.dependencies = {
      ...pkg.dependencies,
      '@inkpi/protocol': 'file:../protocol',
    }
  }

  return pkg
}

export const hooks = {
  readPackage,
}
