import { Mastra } from "@mastra/core";
import { outlineAgent, lectureAgent, quizAgent, studyAssistant } from "./agents";
import { courseBuilderWorkflow } from "./workflows/courseBuilder";

export const mastra = new Mastra({
  agents: { outlineAgent, lectureAgent, quizAgent, studyAssistant },
  workflows: { courseBuilder: courseBuilderWorkflow },
});
