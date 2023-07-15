import fs from 'fs';
import util from 'util';

// Promisify fs.access
const access = util.promisify(fs.access);

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}
