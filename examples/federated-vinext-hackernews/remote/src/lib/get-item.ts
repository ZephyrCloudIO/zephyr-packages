export function transform(val: Record<string, unknown> | null) {
  if (val) {
    return {
      id: val.id as number,
      url: (val.url as string) || '',
      user: val.by as string,
      date: new Date((val.time as number) * 1000).getTime() || 0,
      comments: (val.kids as number[]) || [],
      commentsCount: (val.descendants as number) || 0,
      score: val.score as number,
      title: val.title as string,
    };
  }
  return null;
}
