// src/app/instructions/page.tsx
import React from "react";

interface InstructionsModalProps {
  showInstructions: boolean;
  setShowInstructions: (value: boolean) => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  showInstructions,
  setShowInstructions,
}) => {
  if (!showInstructions) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
      <div
        className="bg-gray-800 text-white p-6 rounded-md max-w-md mx-4"
        style={{
          transform: "perspective(600px) rotateX(5deg)",
          boxShadow: "0 10px 20px rgba(0,0,0,0.7)",
        }}
      >
        <h2 className="text-2xl font-bold mb-4">How to Play COSMIC DODGE</h2>
        <ul className="list-disc pl-5 mb-4">
          <li>
            <strong>Start the Game:</strong> Click Start and wait for the countdown.
          </li>
          <li>
            <strong>Move:</strong> Use the left and right arrow keys to dodge obstacles.
          </li>
          <li>
            <strong>Collect the Coin:</strong> Only gold coins give you points, so aim for them!
          </li>
          <li>
            <strong>Avoid Other Shapes:</strong> All other shapes are hazards that can end the game (unless you’re shielded). Colliding with a hazard will freeze the obstacles and trigger an explosion.
          </li>
          <li>
            <strong>Power‑Ups:</strong> Collect them to activate a shield.
          </li>
          <li>
            <strong>Shield:</strong> When active, press the spacebar to clear nearby obstacles.
          </li>
          <li>
            <strong>Level Up:</strong> Every 500+ points, your level increases.
          </li>
          <li>
            <strong>New Level Effects:</strong> With each new level, obstacles fall faster, appear over a wider area, and spawn more frequently. When a new level is reached, the game pauses, displays a level-up message, and resets obstacle positions. Press "Got It" to resume the game at the increased difficulty.
          </li>
        </ul>
        <button
          onClick={() => setShowInstructions(false)}
          className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};

export default InstructionsModal;
