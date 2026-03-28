/**
 * index.js
 * Application entry point.
 * Mounts the React app into the #root DOM element.
 *
 * Usage (create-react-app / Vite):
 *   npm start    → development server
 *   npm run build → production bundle
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
