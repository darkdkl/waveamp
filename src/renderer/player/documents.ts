import { i18n } from "../i18n";

interface Subscription {
  type: string;
  listener: EventListener;
}

const subscriptions: Subscription[] = [];
const extraDocuments = new Set<Document>();

export function onEveryDocument<K extends keyof DocumentEventMap>(type: K, listener: (event: DocumentEventMap[K]) => void): void {
  const subscription = { type, listener: listener as EventListener };
  subscriptions.push(subscription);
  document.addEventListener(type, subscription.listener);
  extraDocuments.forEach((doc) => doc.addEventListener(type, subscription.listener));
}

export function addPlayerDocument(doc: Document): void {
  if (extraDocuments.has(doc)) return;
  extraDocuments.add(doc);
  subscriptions.forEach(({ type, listener }) => doc.addEventListener(type, listener));
  i18n.addDocument(doc);
}

export function removePlayerDocument(doc: Document): void {
  if (!extraDocuments.delete(doc)) return;
  subscriptions.forEach(({ type, listener }) => doc.removeEventListener(type, listener));
  i18n.removeDocument(doc);
}
