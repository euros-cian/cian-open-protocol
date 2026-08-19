export type ProtocolDecision = "QUALIFIES" | "DOES_NOT_QUALIFY" | "REVIEW_REQUIRED";
export type LanguageProfile = "cy-v0.1" | "cy-v0.2" | string;
export interface Signature { algorithm: "Ed25519"; key_id: string; value: string }
export interface SignedRecord { signature: Signature; [key: string]: unknown }
export interface AgentManifest extends SignedRecord {
  protocol_version: "0.1"; agent_id: string; public_key: string; endpoint: string;
  capabilities: string[]; language_profiles: LanguageProfile[];
}
export interface Balance { balance: number; locked: number; sequence: number }
export interface PoolLike { query(...args: unknown[]): Promise<unknown>; connect(): Promise<unknown>; end(): Promise<void> }
export interface ValidationAttestation extends SignedRecord {
  attestation_id: string; interaction_id: string; language_profile: LanguageProfile;
  decision: ProtocolDecision; reward_state: string; validator_id: string;
}

export function canonicalize(value: unknown): string;
export function unsignedRecord<T extends Record<string, unknown>>(record: T): Omit<T, "signature">;
export function digest(value: unknown): `sha256:${string}`;
export function agentIdFromPublicKey(key: string | object): string;
export function signRecord<T extends Record<string, unknown>>(record: T, privateKey: object, keyId: string): T & SignedRecord;
export function verifyRecord(record: SignedRecord, publicKey: object): boolean;
export function importPublicKey(pem: string): object;
export function exportPublicKey(key: object): string;
export function exportPrivateKey(key: object): string;
export function generateAgentKeys(): { publicKey: object; privateKey: object };
export function recognisedCapacity(commitment: Record<string, number>): number;
export function epochBudget(commitments: Record<string, number>[], computeUnitsPerEntitlement?: number): number;
export function allocateProRata(proofs: Array<{proof_id:string;recipient_agent_id:string;weight:number}>, budget:number): Array<{proof_id:string;recipient_agent_id:string;amount:number}>;
export function analyseWelsh(text: string): { decision: Exclude<ProtocolDecision,"REVIEW_REQUIRED">; evidence: Record<string, unknown> };
export function analyseWelshV2(text: string): { decision: ProtocolDecision; evidence: Record<string, unknown> };

export class AgentClient {
  readonly agentId: string; readonly publicKeyPem: string;
  static create(options: { registryUrl:string; registryPublicKeyPem?:string; endpoint:string; capabilities?:string[]; languageProfiles?:LanguageProfile[] }): AgentClient;
  static createPersistent(options: { credentialsPath:string; passphrase:string; registryUrl:string; registryPublicKeyPem?:string; endpoint:string; capabilities?:string[]; languageProfiles?:LanguageProfile[] }): AgentClient;
  manifest(): AgentManifest; register(): Promise<unknown>; getBalance(seriesId:string): Promise<Balance>;
  transfer(options:{recipient:string;seriesId:string;amount:number;taskId?:string}):Promise<unknown>;
  redeem(options:{seriesId:string;amount:number;workload:string}):Promise<unknown>;
}
export class SettlementRegistry { constructor(options?:Record<string,unknown>); registerAgent(agent:string|AgentManifest):unknown; balance(agentId:string,seriesId:string):Balance; redemption(redemptionId:string):Record<string,unknown>|undefined; releaseRedemption(redemptionId:string,failure?:Record<string,unknown>):Record<string,unknown>; ledgerSummary(seriesId:string):Record<string,unknown> }
export class PostgresSettlementRegistry { readonly pool:PoolLike; static connect(options:{connectionString?:string;pool?:PoolLike;registryId?:string;migrate?:boolean}):Promise<PostgresSettlementRegistry>; close():Promise<void>; redemption(redemptionId:string):Promise<Record<string,unknown>|undefined>; releaseRedemption(redemptionId:string,failure?:Record<string,unknown>):Promise<Record<string,unknown>>; ledgerSummary(seriesId:string):Promise<Record<string,unknown>> }
export class LocalComputeProvider { readonly providerId:string; readonly publicKeyPem:string; readonly resourceClass:string; constructor(options:Record<string,unknown>); createCommitment(options:Record<string,unknown>):SignedRecord; execute(options:Record<string,unknown>):Promise<Record<string,unknown>> }
export class ComputePool { constructor(options:{registry:SettlementRegistry|PostgresSettlementRegistry;now?:()=>Date}); registerProvider(options:Record<string,unknown>):Record<string,unknown>; commitments():SignedRecord[]; execute(options:{redemptionId:string;workload:Record<string,unknown>}):Promise<Record<string,unknown>> }
export class InMemoryComputeJobStore { constructor(options?:{now?:()=>Date}); registerProvider(input:Record<string,unknown>):Promise<Record<string,unknown>>; authenticate(providerId:string,apiToken:string):Promise<boolean>; commitment(commitmentId:string):Promise<Record<string,unknown>|undefined>; suspendProvider(providerId:string,reasonCode:string):Promise<Record<string,unknown>>; resumeProvider(providerId:string):Promise<Record<string,unknown>>; rotateProviderToken(providerId:string,apiToken:string):Promise<Record<string,unknown>>; operations():Promise<Record<string,unknown>>; enqueue(input:Record<string,unknown>):Promise<Record<string,unknown>>; job(jobId:string):Promise<Record<string,unknown>|undefined> }
export class PostgresComputeJobStore { readonly atomicLedgerTransitions:true; constructor(options:{pool:PoolLike;now?:()=>Date}); registerProvider(input:Record<string,unknown>):Promise<Record<string,unknown>>; authenticate(providerId:string,apiToken:string):Promise<boolean>; commitment(commitmentId:string):Promise<Record<string,unknown>|null>; suspendProvider(providerId:string,reasonCode:string):Promise<Record<string,unknown>>; resumeProvider(providerId:string):Promise<Record<string,unknown>>; rotateProviderToken(providerId:string,apiToken:string):Promise<Record<string,unknown>>; operations():Promise<Record<string,unknown>>; enqueue(input:Record<string,unknown>):Promise<Record<string,unknown>>; job(jobId:string):Promise<Record<string,unknown>|null> }
export class ComputeCoordinator { constructor(options:{registry:SettlementRegistry|PostgresSettlementRegistry;store:InMemoryComputeJobStore|PostgresComputeJobStore;now?:()=>Date;leaseMs?:number;maxAttempts?:number;queueAlertThreshold?:number}); registerProvider(input:Record<string,unknown>):Promise<Record<string,unknown>>; enqueue(input:{redemptionId:string;workload:Record<string,unknown>}):Promise<Record<string,unknown>>; claim(providerId:string):Promise<Record<string,unknown>|null>; complete(providerId:string,jobId:string,input:Record<string,unknown>):Promise<Record<string,unknown>>; fail(providerId:string,jobId:string,input?:Record<string,unknown>):Promise<Record<string,unknown>>; suspendProvider(providerId:string,reasonCode:string):Promise<Record<string,unknown>>; resumeProvider(providerId:string):Promise<Record<string,unknown>>; rotateProviderToken(providerId:string,apiToken:string):Promise<Record<string,unknown>>; operations():Promise<Record<string,unknown>>; reapExpired():Promise<Record<string,unknown>[]> }
export function createExecutionReceipt(input:Record<string,unknown>):SignedRecord;
export class RemoteComputeProviderClient { constructor(options:{url:string;apiToken:string;signer:Record<string,unknown>;resourceClass?:string;fetchImpl?:typeof fetch}); claim():Promise<Record<string,unknown>|null>; complete(job:Record<string,unknown>,result:Record<string,unknown>):Promise<Record<string,unknown>>; fail(job:Record<string,unknown>,options?:{reasonCode?:string;retryable?:boolean}):Promise<Record<string,unknown>>; runOnce(executor:(workload:Record<string,unknown>,job:Record<string,unknown>)=>Promise<Record<string,unknown>>):Promise<Record<string,unknown>|null> }
export function createComputePoolServer(options:{coordinator:ComputeCoordinator;store:InMemoryComputeJobStore|PostgresComputeJobStore;adminToken:string;rateLimit?:{windowMs?:number;maxRequests?:number};allowInsecureRemote?:boolean}):{listen(options?:{host?:string;port?:number}):Promise<string>;close():Promise<void>;server:unknown};
export function validateProviderProfile(profile:Record<string,unknown>):Record<string,unknown>;
export function createProviderOnboardingBundle(options:{profile:Record<string,unknown>;credentialsPath:string;passphrase:string;availableFrom:string;availableUntil:string;now?:()=>Date}):Record<string,unknown>;
export function createSafeComputeExecutor(options?:{maxInputBytes?:number}):(workload:Record<string,unknown>)=>Promise<Record<string,unknown>>;
export class WelshValidator { constructor(options:Record<string,unknown>); validate(input:Record<string,unknown>):ValidationAttestation }
export class WelshValidatorV2 extends WelshValidator {}
export class RemoteWelshValidator { constructor(options:{url:string;apiToken:string;fetchImpl?:typeof fetch}); validate(input:Record<string,unknown>):Promise<ValidationAttestation> }
export class InteractionGateway { constructor(options:Record<string,unknown>); receive(input:Record<string,unknown>):Record<string,unknown> }
export class LanguageProofController { constructor(options:Record<string,unknown>); issue(input:Record<string,unknown>):SignedRecord }
export class InMemoryProofStore { add(record:SignedRecord):Promise<void>; unconsumed(profile?:string):Promise<SignedRecord[]> }
export class PostgresProofStore { constructor(options:{pool:PoolLike}) }
export class EpochController { constructor(options:Record<string,unknown>); close(input:Record<string,unknown>):Promise<SignedRecord> }
export class OpenAIResponsesProvider { constructor(options:{apiKey:string;model?:string;fetchImpl?:typeof fetch}); respond(input:Record<string,unknown>):Promise<{text:string;provider:string;model:string}> }
export class ConversationalProtocolAgent { constructor(options:Record<string,unknown>); handle(input:{sessionId:string;text:string;humanOriginAssurance?:string;outcomeEvidence?:Record<string,unknown>}):Promise<Record<string,unknown>> }
export class PilotSessionManager { constructor(options?:Record<string,unknown>); issue(input:Record<string,unknown>):Record<string,unknown>; authorise(token:string):Record<string,unknown>; withdraw(token:string):Record<string,unknown> }
export class PostgresPilotSessionStore { constructor(options:{pool:PoolLike;[key:string]:unknown}) }
export class InMemoryAppealStore { constructor(options?:Record<string,unknown>) }
export class PostgresAppealStore { constructor(options:{pool:PoolLike;[key:string]:unknown}) }
export class AppealReviewer { constructor(options:Record<string,unknown>); resolve(input:Record<string,unknown>):Promise<SignedRecord> }
export function createAppealResolution(input:Record<string,unknown>):SignedRecord;
export function evaluateRewardState(input:Record<string,boolean>):{id:string;weight:number};
export function highestRewardState(states:Array<{id:string;weight:number}>):{id:string;weight:number};
export function evaluateWelshCases(cases:unknown[],options?:Record<string,unknown>):Record<string,unknown>;
export type WelshReview = { case_id:string; reviewer_id:string; decision:"QUALIFIES"|"DOES_NOT_QUALIFY"|"REVIEW_REQUIRED"; role:"reviewer"|"adjudicator"; reviewed_at?:string };
export function createBlindReviewPacket(cases:Array<Record<string,unknown>>):Array<{case_id:string;text:string;category:string}>;
export function assessWelshReview(options:{cases:Array<Record<string,unknown>>;reviews:WelshReview[];analyser:(text:string)=>{decision:string};profileId?:string;minimumReviewers?:number}):Record<string,unknown>;
export function createWelshReviewServer(options:{cases:Array<Record<string,unknown>>;reviewerId:string;outputPath:string|URL;uiHtml:string;logoPng?:Uint8Array;now?:()=>Date}):{restore():Promise<void>;listen(options?:{host?:string;port?:number}):Promise<string>;close():Promise<void>};
export function extractOutputText(response:unknown):string;
export function encryptCredentials(credentials:unknown,passphrase:string):unknown;
export function decryptCredentials(envelope:unknown,passphrase:string):unknown;
export function saveCredentials(path:string,credentials:unknown,passphrase:string):void;
export function loadCredentials(path:string,passphrase:string):unknown;
export function credentialsExist(path:string):boolean;
export function createSigningService(options:{serviceId:string;credentialsPath?:string;passphrase?:string}):Record<string,unknown>;
export function createRegistrySigner(options:Record<string,unknown>):Record<string,unknown>;
export function createRegistryServer(options?:Record<string,unknown>): { listen(options?:{host?:string;port?:number}):Promise<string>; close():Promise<void>; registry:unknown; signer:unknown; server:unknown };
export function createConversationServer(options:Record<string,unknown>): { listen(options?:{host?:string;port?:number}):Promise<string>; close():Promise<void> };
export function createValidatorServer(options:Record<string,unknown>): { listen(options?:{host?:string;port?:number}):Promise<string>; close():Promise<void> };
export function createGovernanceServer(options:Record<string,unknown>): { listen(options?:{host?:string;port?:number}):Promise<string>; close():Promise<void> };
export const DEFAULT_INSTRUCTIONS: string;
