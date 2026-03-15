import type { QuestionCategory } from "@/types";

const CATEGORY_DESCRIPTIONS: Record<QuestionCategory, string> = {
  "product-management": `Product Management fundamentals and advanced concepts including:
- Product strategy, vision, and roadmapping
- Prioritization frameworks (RICE, MoSCoW, Kano)
- Metrics and KPIs (North Star, AARRR, cohort analysis)
- User research and discovery
- Stakeholder management
- Go-to-market strategy
- A/B testing and experimentation
- Product-led growth
- Competitive analysis
- Pricing and monetization
- Agile/Scrum/Kanban methodologies`,

  "ai-pm": `AI Product Management and AI concepts including:
- ML product lifecycle and deployment
- Prompt engineering and LLM applications
- AI ethics, bias, and fairness
- Data strategy and data flywheels
- Model evaluation metrics (precision, recall, F1, AUC)
- AI product design patterns
- RAG, fine-tuning, and embeddings
- AI safety and alignment
- Foundation models and their trade-offs
- AI-native product thinking
- Build vs buy for AI capabilities`,

  "tech-basics": `Technical foundations for AI PMs including:
- APIs, REST, GraphQL basics
- Database fundamentals (SQL vs NoSQL)
- Cloud infrastructure basics (AWS, GCP, Azure)
- CI/CD and deployment pipelines
- Version control (Git) fundamentals
- Vibe coding and AI-assisted development
- System design basics (microservices, monoliths)
- Frontend vs backend architecture
- Authentication and authorization
- Caching strategies
- Performance and scalability basics`,

  "ux-ui": `UX/UI design principles including:
- Information architecture
- Usability heuristics (Nielsen)
- Accessibility (WCAG)
- Mobile-first design
- Design systems
- User journey mapping
- Wireframing and prototyping
- Visual hierarchy
- Interaction design patterns`,
};

export function buildBatchPrompt(
  categories: QuestionCategory[],
  count: number,
  existingFingerprints: string[]
): string {
  const categoryBlock = categories
    .map(
      (cat) =>
        `### ${cat}\n${CATEGORY_DESCRIPTIONS[cat]}`
    )
    .join("\n\n");

  const dedupBlock =
    existingFingerprints.length > 0
      ? `\n\nAVOID generating questions similar to these existing question fingerprints (first 20 shown):\n${existingFingerprints.slice(0, 20).join("\n")}`
      : "";

  return `You are an expert quiz question generator for product management professionals studying for PM roles, with special focus on AI product management.

Generate exactly ${count} high-quality multiple-choice questions across these categories:

${categoryBlock}

## Requirements:
- Each question must have exactly 4 answer options (A, B, C, D)
- Questions should be non-trivial and test real understanding, not trivia
- Mix difficulty levels: roughly 30% easy, 50% medium, 20% hard
- Easy: tests recall of key concepts
- Medium: tests application and analysis
- Hard: tests synthesis, evaluation, or nuanced trade-offs
- Explanations should teach the concept, not just state the answer
- Avoid "all of the above" or "none of the above" options
- Make wrong answers plausible but clearly incorrect to someone who knows the material
- Each question should be self-contained and not reference other questions
- Vary subCategories within each category
- Tags should be 2-5 relevant keywords per question${dedupBlock}

## Distribution:
Distribute questions approximately according to these weights:
- product-management: 60%
- ai-pm: 20%
- tech-basics: 15%
- ux-ui: 5%

Respond with valid JSON matching the required schema exactly.`;
}

export const BATCH_RESPONSE_SCHEMA = {
  type: "json_schema" as const,
  name: "question_batch",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            category: {
              type: "string" as const,
              enum: ["product-management", "ai-pm", "tech-basics", "ux-ui"],
            },
            subCategory: { type: "string" as const },
            difficulty: {
              type: "string" as const,
              enum: ["easy", "medium", "hard"],
            },
            questionText: { type: "string" as const },
            options: {
              type: "array" as const,
              items: { type: "string" as const },
            },
            correctOption: {
              type: "string" as const,
              enum: ["A", "B", "C", "D"],
            },
            explanation: { type: "string" as const },
            tags: {
              type: "array" as const,
              items: { type: "string" as const },
            },
          },
          required: [
            "category",
            "subCategory",
            "difficulty",
            "questionText",
            "options",
            "correctOption",
            "explanation",
            "tags",
          ] as const,
          additionalProperties: false as const,
        },
      },
    },
    required: ["questions"] as const,
    additionalProperties: false as const,
  },
};
