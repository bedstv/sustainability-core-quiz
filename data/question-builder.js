(() => {
  "use strict";

  function distractors(items, index, field) {
    const picks = [];
    for (let offset = 1; picks.length < 3 && offset < items.length; offset += 1) {
      const value = items[(index + offset * 7) % items.length][field];
      if (value !== items[index][field] && !picks.includes(value)) picks.push(value);
    }
    return picks;
  }

  window.buildConceptQuestions = (module, concepts) => {
    const questions = [];
    concepts.forEach((concept, index) => {
      const definitionOptions = [
        concept.definition,
        ...distractors(concepts, index, "definition")
      ];
      const termOptions = [
        concept.term,
        ...distractors(concepts, index, "term")
      ];
      const firstNumber = index * 2 + 1;
      questions.push({
        id: `${module}-${String(firstNumber).padStart(3, "0")}`,
        module,
        topic: concept.topic,
        difficulty: "基礎",
        question: `依 ${module} 講義，下列何者最符合「${concept.term}」？`,
        options: definitionOptions,
        answer: 0,
        explanation: concept.definition,
        page: concept.page
      });
      questions.push({
        id: `${module}-${String(firstNumber + 1).padStart(3, "0")}`,
        module,
        topic: concept.topic,
        difficulty: concept.difficulty || "理解",
        question: concept.clue,
        options: termOptions,
        answer: 0,
        explanation: `${concept.term}：${concept.definition}`,
        page: concept.page
      });
    });
    return questions;
  };
})();
