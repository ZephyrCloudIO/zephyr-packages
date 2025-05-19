import { Suspense } from "react";
import RemoteApp from "remote/App";
import "./App.css";

function App() {

	return (
		<div className="App">
			<h1>Host Application</h1>
			<div style={{ border: "1px solid red", padding: "20px" }}>
				<h2>The remote Application should display deploy</h2>
			<Suspense fallback={<div>Loading Remote App...</div>}>
				<RemoteApp />
			</Suspense>
			</div>
		</div>
	);
}

export default App;
