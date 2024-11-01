/* Local modules */
import MessageHandlerParams from './../aimodeltype';
import { AIModels } from './../../types/AiModels';
import { Util } from './../../util/Util';

/* Models */
import { StabilityModel } from '../../models/StabilityModel';
import { ChatGPTModel } from './../../models/OpenAIModel';
import { GeminiModel } from './../../models/GeminiModel';
import { FluxModel } from './../../models/FluxModel';
import { ENV } from '../env';

interface ModelByPrefix {
  modelName: AIModels;
  prefix: string;
}

/* Declare models */
const modelTable: Record<AIModels, any> = {
  ChatGPT: ENV.OPENAI_ENABLED ? new ChatGPTModel() : null,
  Gemini: ENV.GEMINI_ENABLED ? new GeminiModel() : null,
  FLUX: ENV.HF_ENABLED ? new FluxModel() : null,
  Stability: ENV.STABILITY_ENABLED ? new StabilityModel() : null,
  Dalle: null
};

if (ENV.DALLE_ENABLED && ENV.OPENAI_ENABLED) {
  modelTable.Dalle = modelTable.ChatGPT;
} else if (ENV.DALLE_ENABLED && !ENV.OPENAI_ENABLED) {
  modelTable.Dalle = new ChatGPTModel();
}

// handles message
export async function handleMessage({ client, msg, metadata }: MessageHandlerParams) {
  const modelInfo: ModelByPrefix | undefined = Util.getModelByPrefix(
    metadata.text,
    metadata.fromMe
  );
  if (!modelInfo) {
    if (ENV.Debug) {
      console.log("[Debug] Model '" + modelInfo + "' not found");
    }
    return;
  }

  const model = modelTable[modelInfo.modelName];
  if (!model) {
    if (ENV.Debug) {
      console.log("[Debug] Model '" + modelInfo.modelName + "' is disabled or not found");
    }
    return;
  }

  const prompt: string = metadata.text.split(' ').slice(1).join(' ');
  const messageResponse = await client.sendMessage(
    metadata.remoteJid,
    { text: ENV.Processing },
    { quoted: msg }
  );

  model.sendMessage(
    { sender: metadata.sender, prompt: prompt, metadata: metadata, prefix: modelInfo.prefix },
    async (res: any, err: any) => {
      if (err) {
        client.sendMessage(metadata.remoteJid, {
          text: "Sorry, i can't handle your request right now.",
          edit: messageResponse?.key
        });
        console.error(err);
        return;
      }

      if (res.image) {
        // delete the old message
        if (messageResponse?.key) {
          client.sendMessage(metadata.remoteJid, { delete: messageResponse.key });
        }
        client.sendMessage(metadata.remoteJid, res, { quoted: msg });
      } else {
        res.edit = messageResponse?.key;
        client.sendMessage(metadata.remoteJid, res);
      }
    }
  );
}

// handles message from self
export async function handlerMessageFromMe({ metadata, client, msg, type }: MessageHandlerParams) {
  // if (metadata.fromMe && metadata.isQuoted) return;
  // if (metadata.isQuoted && Util.getModelByPrefix(metadata.text)) return;
  await handleMessage({ metadata, client, msg, type });
}
