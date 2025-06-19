async function getServerTime() {
  'use server';
  
  const now = new Date();
  return now.toISOString();
}

export default async function ServerTime() {
  const serverTime = await getServerTime();
  
  return (
    <div>
      <h2>Server Time</h2>
      <p>Generated on server at: {serverTime}</p>
    </div>
  );
}