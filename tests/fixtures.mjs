export const roster = (n = 4) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i + 1).padStart(3, "0"),
    email: `student${String(i + 1).padStart(2, "0")}@example.edu`,
    name: `Student ${String(i + 1).padStart(2, "0")}`,
  }));
const topics = [
  "Prompt structure",
  "Evidence and retrieval",
  "Model limits",
  "Tool use",
];
export const bank = (n = 12) =>
  Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    topic: topics[i % 4],
    prompt: `Give your top insider tip about ${topics[i % 4].toLowerCase()} in situation ${i + 1}.`,
    difficulty: 3,
    insights: [
      {
        id: "a",
        text: "Use clear goals and context.",
        weight: 1,
        guidance: "Accept clear explanation of goals and context.",
        source: "Synthetic workflow fixture, not course evidence",
      },
      {
        id: "b",
        text: "Check evidence against reliable sources.",
        weight: 2,
        guidance: "Accept source verification and grounded claims.",
        source: "Synthetic workflow fixture",
      },
      {
        id: "c",
        text: "Test assumptions and inspect outputs.",
        weight: 2,
        guidance: "Accept iteration, validation and examples.",
        source: "Synthetic workflow fixture",
      },
      {
        id: "d",
        text: "Protect sensitive information.",
        weight: 1,
        guidance: "Accept scoped access and privacy.",
        source: "Synthetic workflow fixture",
      },
    ],
  }));
export const evaluation = (ids = ["a"], correctness = 1) => ({
  correctness,
  depth: 0.8,
  insights: ids.map((id) => ({
    id,
    credit: 1,
    reason: "Valid synthetic contribution.",
  })),
  explanation: "Synthetic evaluation fixture.",
});
