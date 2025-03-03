export interface ServerComponentProps {
  id: string;
  text: string;
}

export interface ServerComponentState {
  id: string;
  text: string;
  hydrated: boolean;
  clickCount: number;
}

export interface SSRStoreData {
  [componentId: string]: ServerComponentState;
}

export interface ZephyrSSRStore {
  [remote: string]: SSRStoreData;
}