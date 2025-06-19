async function fetchServerData() {
  'use server';
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    message: 'This data was fetched on the server',
    timestamp: Date.now(),
    randomNumber: Math.floor(Math.random() * 1000)
  };
}

export default async function ServerData() {
  const data = await fetchServerData();
  
  return (
    <div>
      <h2>Server Data</h2>
      <p>{data.message}</p>
      <p>Timestamp: {data.timestamp}</p>
      <p>Random number: {data.randomNumber}</p>
    </div>
  );
}