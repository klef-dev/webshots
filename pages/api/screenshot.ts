// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import axios from "axios";
import FormData from "form-data";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { nanoid } from "nanoid";
import type { NextApiRequest, NextApiResponse } from "next";
import validUrl from "valid-url";
import screenshot from "../../lib/screenshot";
import path from "path";

type Data = {
  id?: {
    asset: string;
    public: string;
  };
  image?: string | Buffer;
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const {
    url,
    height,
    quality,
    type,
    width,
  }: {
    width?: number;
    height?: number;
    quality?: number;
    type?: "png" | "jpeg" | undefined;
    url?: string;
  } = req.query;

  const apiKey = req.headers["x-api-key"];

  if (!apiKey) return res.status(400).json({ message: "API Key is required" });

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!url) return res.status(400).json({ message: "URL is required" });

  if (!validUrl.isUri(url)) {
    return res.status(400).json({ message: "Invalid URL" });
  }

  try {
    const img = await screenshot(url, { height, quality, type, width });
    const image = img.toString("base64");
    const id = nanoid();
    const dir = path.join(__dirname, "public", "images");

    // Ensure the directory exists
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    writeFileSync(path.join(dir, `${id}.${type || "png"}`), image, "base64");

    const formData = new FormData();
    formData.append(
      "file",
      createReadStream(`./public/images/${id}.${type || "png"}`)
    );
    formData.append("upload_preset", "screenshots");

    const { data } = await axios.post(process.env.UPLOAD_URL || "", formData);

    // delete the image from the server
    unlinkSync(`./public/images/${id}.${type || "png"}`);

    res.status(200).json({
      id: {
        asset: data.asset_id,
        public: data.public_id,
      },
      image: `${data.url}`,
      message: "Here is your shot",
    });
  } catch (error: any) {
    if (error.response) {
      return res
        .status(error.response.status)
        .json({ message: error.response.data });
    }
    res.status(500).json({ message: error.message });
  }
}
