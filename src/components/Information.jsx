import React, { useState, useEffect, useRef } from "react";
import Transcription from "./Transcription";
import Translation from "./Translation";

export default function Information(props) {
  const { output } = props;
  console.log(output);
  const [tab, setTab] = useState("transcription");
  const [translation, setTranslation] = useState(null);
  const [toLanguage, setToLanguage] = useState("Select Language");
  const [translating, setTranslating] = useState(null);

  const worker = useRef();
  const textElement =
    tab === "transcription"
      ? output.map((val) => val.text)
      : translation || "No translation";

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL("../utils/translate.worker.js", import.meta.url),
        {
          type: "module",
        }
      );
    }

    const onMessageReceived = async (e) => {
      switch (e.data.status) {
        case "initiate":
          console.log("DOWNLOADING");
          break;
        case "progress":
          console.log("LOADING");
          break;
        case "update":
          setTranslation(e.data.output);
          console.log(e.data.output);
          break;
        case "complete":
          setTranslating(false);
          console.log("DONE");
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () =>
      worker.current.removeEventListener("message", onMessageReceived);
  });

  function generateTranslation() {
    if (translating || toLanguage === "Select language") {
      return;
    }
    setTranslating(true);

    worker.current.postMessage({
      text: output.map((val) => val.text),
      src_language: "eng_Latn",
      tgt_lang: toLanguage,
    });
  }
  function handleCopies() {
    navigator.clipboard.writeText(textElement);
  }

  function handleDownload() {
    const element = document.createElement("a");
    const file = new Blob([textElement], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `Freescribe_${new Date().toString()}.txt`;
    document.body.appendChild(element);
    element.click();
  }

  return (
    <main
      className="flex-1 p-4 flex flex-col gap-3 
      text-center sm:gap-4 
        justify-center pb-20 max-w-prose  w-full mx-auto"
    >
      <h1 className="font-semibold text-4xl sm:text-5xl md:text-6xl whitespace-nowrap">
        Your<span className="text-blue-300 bold "> Transcription</span>
      </h1>
      <div className="grid grid-cols-2 mx-auto bg-white border-2 border-solid border-blue-400 shadow rounded-full overflow-hidden items-center font-poppins">
        <button
          onClick={() => setTab("transcription")}
          className={`px-4 py-1 duration-200  ${
            tab === "transcription"
              ? "bg-blue-400 text-white"
              : "text-blue-400 hover:text-blue-600"
          }`}
        >
          Transcription
        </button>
        <button
          onClick={() => setTab("translation")}
          className={`px-4 py-1 duration-200  ${
            tab === "translation"
              ? "bg-blue-400 text-white"
              : "text-blue-400 hover:text-blue-600"
          }`}
        >
          Translation
        </button>
      </div>
      <div className="my-8 flex flex-col">
        {tab === "transcription" ? (
          <Transcription {...props} textElement={textElement} />
        ) : (
          <Translation
            {...props}
            toLanguage={toLanguage}
            translating={translating}
            textElement={textElement}
            setTranslation={setTranslation}
            setTranslating={setTranslating}
            setToLanguage={setToLanguage}
            generateTranslation={generateTranslation}
          />
        )}
      </div>
      <div className="flex items-center gap-4 mx-auto text-base">
        <button
          title="Copy"
          onClick={handleCopies}
          className="bg-white hover:text-blue-500 duration-200 text-blue-300 p-2 rounded px-4"
        >
          <i className="fa-solid fa-copy "></i>
        </button>
        <button
          title="Download"
          onClick={handleDownload}
          className="bg-white hover:text-blue-500 duration-200 text-blue-300 p-2 rounded px-4"
        >
          <i className="fa-solid fa-download "></i>
        </button>
      </div>
    </main>
  );
}
