import React, { useRef, useEffect } from "react";

export default function FileDisplay(props) {
  const { handleAudioReset, file, audioStream, handleFormSubmission } = props;
  const audioRef = useRef();
  useEffect(() => {
    if (!file && !audioStream) return;

    if (!audioRef.current) return;

    if (file) {
      console.log("HERE FILE", file);
      audioRef.current.src = URL.createObjectURL(file);
    } else {
      console.log("HERE AUDIO", audioStream);
      audioRef.current.src = URL.createObjectURL(audioStream);
    }
  }, [audioStream, file]);

  return (
    <main
      className="flex-1 p-4 flex flex-col gap-3 
      text-center sm:gap-4 
        justify-center pb-20 w-72 sm:w:96 max-w-full mx-auto"
    >
      <h1 className="font-semibold text-4xl sm:text-5xl md:text-6xl">
        Your<span className="text-blue-400 bold "> File</span>
      </h1>
      <div className="flex flex-col text-left my-4">
        <h3 className="font-semibold">Name</h3>
        <p>{file ? file.name : "Custom audio"}</p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handleAudioReset}
          className="text-slate-400 hover:text-blue-600 font-sans"
        >
          Reset
        </button>
        <button
          onClick={handleFormSubmission}
          className="specialBtn px-3 p-2 rounded-lg text-blue-400
        flex items-center gap-2 font-medium"
        >
          <p className="font-poppins">Transcribe</p>
          <i className="fa-solid fa-pen-nib"></i>
        </button>
      </div>
    </main>
  );
}
