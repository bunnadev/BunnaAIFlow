export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

export interface ReferenceImage {
  base64: string;
  mimeType: string;
}

export interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  referenceImages?: ReferenceImage[];
  aspectRatio: AspectRatio;
  model: string;
}

export interface VideoGenParams {
  prompt: string;
  negativePrompt?: string;
  model: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  resolution?: string;
  firstFrame?: ReferenceImage;
  lastFrame?: ReferenceImage;
  referenceImages?: ReferenceImage[];
}

export interface GenResult {
  base64: string;
  mimeType: string;
}

export interface ImageGenProvider {
  generateImage(params: ImageGenParams): Promise<GenResult>;
}

export interface VideoGenProvider {
  generateVideo(params: VideoGenParams): Promise<GenResult>;
}
