import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./library.js";

const file = path.join(dataDir, "campaigns.json");
let memory = null;
let queue = Promise.resolve();

async function readAll() {
  await queue;
  if (memory) return memory;
  try {
    memory = JSON.parse(await readFile(file, "utf8"));
  } catch {
    memory = [];
  }
  return memory;
}

function persist(campaigns) {
  memory = campaigns;
  queue = queue.then(async () => {
    await mkdir(dataDir, { recursive: true });
    await writeFile(file, JSON.stringify(campaigns, null, 2));
  });
  return queue;
}

export async function listCampaigns() {
  return readAll();
}

export async function getCampaign(id) {
  return (await readAll()).find((campaign) => campaign.id === id) || null;
}

export async function saveCampaign(campaign) {
  const all = [...(await readAll())];
  const index = all.findIndex((item) => item.id === campaign.id);
  if (index >= 0) all[index] = campaign;
  else all.unshift(campaign);
  await persist(all);
  return campaign;
}
