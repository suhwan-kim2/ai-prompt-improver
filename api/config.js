export default async function handler(_req, res) {
  // 외부 JSON이 아직 없다 가정 → 기본값 내장
  const config = {
    version: "pc-0.3",
    intentSlots: {
      image: [
        { key: "subject", weight: 22, required: true },
        { key: "style", weight: 20, required: true },
        { key: "ratio_size", weight: 18, required: true },
        { key: "lighting_camera", weight: 18, required: true },
        { key: "use_rights", weight: 12, required: true },
        { key: "negatives", weight: 10, required: true }
      ],
      video: [
        { key: "purpose", weight: 22, required: true },
        { key: "length", weight: 18, required: true },
        { key: "style", weight: 18, required: true },
        { key: "platform", weight: 14, required: true },
        { key: "audio_caption", weight: 14, required: true },
        { key: "rights", weight: 14, required: true }
      ],
      dev: [
        { key: "type", weight: 20, required: true },
        { key: "core_features", weight: 22, required: true },
        { key: "target_users", weight: 16, required: true },
        { key: "tech_pref_constraints", weight: 18, required: true },
        { key: "priority", weight: 12, required: true },
        { key: "security_auth", weight: 12, required: true }
      ]
    },
    promptChecklist: {
      weights: { clarity: 20, specificity: 25, format: 20, executability: 20, constraints_quality: 15 },
      rules: {
        clarity: ["지시대명사 금지", "중의성 0", "모순 0"],
        specificity: ["수치/조건 포함", "도메인 슬롯 반영"],
        format: ["언어=ko", "≤500자", "구조화(문장/목록)"],
        executability: ["모델 범위 내", "외부의존 명시"],
        constraints_quality: ["부정 프롬프트", "스펙/제약 반영"]
      }
    },
    cutoffs: { intent: 95, prompt: 95 },
    routing: {
      image: { model: "Nanobanana", endpoint: process.env.MCP_IMAGE || "" },
      video: { model: "Pika",        endpoint: process.env.MCP_VIDEO || "" },
      dev:   { model: "Claude",      endpoint: process.env.MCP_DEV   || "" }
    }
  };
  res.status(200).json(config);
}
