import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    output: { type: String, required: true },
  },
  { _id: false },
);

const problemSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, match: /^[a-z0-9-]+$/ },
    title: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Easy" },
    statement: { type: String, required: true },
    samples: { type: [testCaseSchema], default: [] }, // shown to users
    tests: { type: [testCaseSchema], default: [] }, // hidden, used for judging
    timeLimitMs: { type: Number, default: 2000, min: 100, max: 10000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// What a normal user is allowed to see: never the hidden tests.
problemSchema.methods.toPublic = function toPublic() {
  return {
    slug: this.slug,
    title: this.title,
    difficulty: this.difficulty,
    statement: this.statement,
    samples: this.samples,
    timeLimitMs: this.timeLimitMs,
  };
};

export const Problem = mongoose.model("Problem", problemSchema);
