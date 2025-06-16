import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import VoiceInputPage from "./pages/VoiceInputPage";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-blue-900 text-white p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-wide">SpeechAI</h1>
          <nav>
            <Link to="/" className="mr-4 hover:underline">
              Home
            </Link>
            <Link to="/voice" className="hover:underline">
              Voice Input
            </Link>
          </nav>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/voice" element={<VoiceInputPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
