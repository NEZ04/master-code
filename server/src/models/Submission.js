import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: "Problem", required: true },
    language: { type: String, enum: ["python", "cpp", "javascript"], required: true },
    code: { type: String, required: true, maxlength: 100_000 },
    verdict: { type: String, default: "Pending" },
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    timeMs: { type: Number, default: 0 },
    compileOutput: { type: String },
  },
  { timestamps: true },
);

export const Submission = mongoose.model("Submission", submissionSchema);
