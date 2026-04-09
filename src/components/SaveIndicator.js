/**
 * components/SaveIndicator.js
 * Small inline indicator showing autosave status and time of last save.
 */
import React, { useState, useEffect, useRef } from "react";
import Icon from "./Icon";
import { nowTime } from "../utils/idGenerators";

/**
 * @param {{ saved: boolean, saveError?: boolean }} props
 */
const SaveIndicator = ({ saved, saveError }) => {
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const prevSaved = useRef(true); // mirrors the initial saved=true state in App.js

  useEffect(() => {
    // Only record time when saved transitions false → true (actual write succeeded)
    if (saved && !prevSaved.current) {
      setLastSavedTime(nowTime());
    }
    prevSaved.current = saved;
  }, [saved]);

  if (saveError) {
    return (
      <span className="save-indicator" style={{ color: "#ef4444" }}>
        Gagal menyimpan ✗
      </span>
    );
  }

  return (
    <span className={`save-indicator ${saved ? "saved" : "saving"}`}>
      {saved ? (
        <>
          <Icon name="check" size={12} color="#10b981" />
          Tersimpan
          {lastSavedTime && (
            <span className="save-indicator__time"> · {lastSavedTime}</span>
          )}
        </>
      ) : (
        "Menyimpan..."
      )}
    </span>
  );
};

export default SaveIndicator;
