import * as fs from 'fs'

export function loadJsonFile(filePath: string) {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading the file', error)
  }
}
