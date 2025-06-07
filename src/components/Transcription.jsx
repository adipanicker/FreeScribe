import React from "react";

export default function Transcription(props) {
  const { textElement } = props;
  console.log("textElement:", textElement, "type:", typeof textElement);

  return <div>{textElement}</div>;
}
