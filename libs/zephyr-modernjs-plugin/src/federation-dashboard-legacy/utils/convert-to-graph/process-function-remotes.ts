import { Consume } from './module-part-one';

interface ProcessFunctionRemoteParams {
  functionRemotes: [file: string, applicationID: string, name: string][];
  consumes: Consume[];
}
export function processFunctionRemotes(params: ProcessFunctionRemoteParams): {
  consumes: Consume[];
} {
  const { functionRemotes, consumes } = params;
  // TODO move this into the main consumes loop
  if (!Array.isArray(functionRemotes)) {
    return { consumes };
  }
  const dynamicConsumes: Consume[] = Object.values(
    functionRemotes.reduce(
      (acc, [file, applicationID, name]) => {
        const cleanName = name.replace('./', '');
        const objectId = `${applicationID}/${cleanName}`;
        const cleanFile = file.replace('./', '');
        const foundExistingConsume = consumes.find(
          (consumeObj) =>
            consumeObj.applicationID === applicationID && consumeObj.name === cleanName
        );
        if (foundExistingConsume) {
          foundExistingConsume.usedIn.add(cleanFile);
          return acc;
        }
        if (acc[objectId]) {
          acc[objectId].usedIn.add(cleanFile);
          return acc;
        }
        acc[objectId] = {
          applicationID,
          name: cleanName,
          consumingApplicationID: name,
          usedIn: new Set([cleanFile]),
        };
        return acc;
      },
      {} as Record<string, Consume>
    )
  );
  consumes.push(...dynamicConsumes);

  return { consumes };
}
