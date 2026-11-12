import { spawn } from "node:child_process";
import { config } from "./config";

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${bin} exited ${code}:\n${err.slice(-2000)}`)),
    );
  });
}

export const ffmpeg = (args: string[]) => run(config.ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args]);

export async function probeDuration(file: string): Promise<number> {
  const out = await run(config.ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return parseFloat(out.trim()) || 0;
}

export async function probeSize(file: string): Promise<{ w: number; h: number }> {
  const out = await run(config.ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]);
  const [w, h] = out.trim().split(",").map(Number);
  return { w, h };
}

/** Escape a path for use inside an ffmpeg filter argument. */
export const filterPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
