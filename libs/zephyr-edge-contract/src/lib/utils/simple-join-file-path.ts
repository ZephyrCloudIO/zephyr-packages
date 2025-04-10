export const simpleJoinFilePath = (rPath: string, rName: string): string => {
  if (!rPath) {
    return rName;
  }
  const transformPath = (str: string) => {
    if (str === '.') {
      return '';
    }
    if (str.startsWith('./')) {
      return str.replace('./', '');
    }
    if (str.startsWith('/')) {
      const strWithoutSlash = str.slice(1);
      if (strWithoutSlash.endsWith('/')) {
        return strWithoutSlash.slice(0, -1);
      }
      return strWithoutSlash;
    }
    return str;
  };

  const transformedPath = transformPath(rPath);

  if (!transformedPath) {
    return rName;
  }

  if (transformedPath.endsWith('/')) {
    return `${transformedPath}${rName}`;
  }

  return `${transformedPath}/${rName}`;
};
