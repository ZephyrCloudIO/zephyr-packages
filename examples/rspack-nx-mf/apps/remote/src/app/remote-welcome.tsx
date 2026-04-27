export function RemoteWelcome({ title }: { title: string }) {
  return (
    <div>
      <h3>{title}</h3>
      <p>Remote module served by Rspack Module Federation.</p>
    </div>
  );
}

export default RemoteWelcome;
