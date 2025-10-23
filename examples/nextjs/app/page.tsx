interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}
// export const dynamic = 'force-dynamic'
export default async function Home() {
  const response = await fetch('https://jsonplaceholder.typicode.com/posts');
  const posts: Post[] = await response.json();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Posts from JSONPlaceholder</h1>
      <div className="grid gap-4">
        {posts.slice(0, 10).map((post) => (
          <div key={post.id} className="border rounded-lg p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">{post.title}</h2>
            <p className="text-gray-600">{post.body}</p>
            <div className="text-sm text-gray-400 mt-2">
              Post ID: {post.id} | User ID: {post.userId}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
