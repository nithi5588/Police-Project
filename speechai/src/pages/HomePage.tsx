import React from "react";

const HomePage: React.FC = () => (
  <div className="max-w-xl mx-auto text-center">
    <h2 className="text-3xl font-bold mb-4">Welcome to SpeechAI</h2>
    <p className="mb-6 text-lg text-gray-700">
      SpeechAI helps police officers transcribe voice input into editable Telugu
      text and export it as a .docx document.
    </p>
    <ol className="text-left mb-6 list-decimal list-inside text-gray-600">
      <li>
        Go to the <b>Voice Input</b> page.
      </li>
      <li>
        Press <b>Record</b> and speak in Telugu.
      </li>
      <li>
        Press <b>Transcribe</b> to convert your speech to text.
      </li>
      <li>Edit the text as needed.</li>
      <li>
        Export the text as a <b>.docx</b> file.
      </li>
    </ol>
    <p className="text-blue-900 font-semibold">
      Designed for accessibility and ease of use.
    </p>
  </div>
);

export default HomePage;
