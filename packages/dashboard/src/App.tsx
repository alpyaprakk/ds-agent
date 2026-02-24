import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          DS Agent Dashboard
        </h1>
        <p className="text-gray-600 mb-8">
          Design System Agent - Multi-workspace manager
        </p>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
          <p className="text-gray-700 mb-4">
            Welcome to DS Agent! The intelligent design system management platform.
          </p>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-lg">✅ Project Setup Complete</h3>
              <p className="text-gray-600">All packages initialized and ready.</p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold text-lg">🚧 Next Steps</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Configure database connection</li>
                <li>Setup Figma integration</li>
                <li>Initialize first workspace</li>
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => setCount(count + 1)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition"
            >
              Counter: {count}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
