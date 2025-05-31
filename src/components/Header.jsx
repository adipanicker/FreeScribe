import React from "react";

export default function Header() {
  return (
    <header className="flex items-center justify-between gap-4 p-4">
      <a href="/">
        <h1 className="font-['Poppins'] text-3xl font-bold">
          Free<span className="text-blue-400">Scribe</span>
        </h1>{" "}
      </a>
      <a
        href="/"
        className="flex items-center gap-2 specialBtn
       px-3 py-2 text-sm rounded-lg text-blue-400"
      >
        <p className="font-opensans font-bold text-2xl ">New</p>
        <i className="fa-solid fa-plus text-1xl font-bold"></i>
      </a>
    </header>
  );
}
