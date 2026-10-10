import { randomUUID } from "node:crypto";
import type { EncoreAgent } from "../agent/loop.js";
import type { JsonModel } from "../llm.js";
import type { QlooClient } from "../qloo/client.js";
import type { LoggedRequest, QlooStore } from "../qloo/store.js";
import type { AppStore, Exclusion, ReactionValue, Resident } from "../store/appStore.js";
import { compareSystems, type ComparisonColumn } from "./compare.js";
import { DEMO_RESIDENTS, demoResident, type DemoResident } from "./demoResidents.js";
import { planGroupSession, type GroupMember, type GroupPlan } from "./group.js";
import { planFromReactions } from "./learning.js";
import { buildMemoryBox, type Favorite, type MemoryBox, type MemoryItem } from "./memoryBox.js";
import { conversationStarters, tagsFor, type Language } from "./starters.js";
import { visitKitContent, visitPicks, type VisitKitContent } from "./visitKit.js";

export interface ResidentView {
  resident: Resident;
  favorites: Favorite[];
  reactions: ReturnType<AppStore["reactions"]>;
  exclusions: Exclusion[];
  visitKits: ReturnType<AppStore["visitKitsFor"]>;
}

const scopeFor = (kind: string) => `${kind}-${randomUUID()}`;

/** Composes Qloo, the model and Encore's store into the product's use cases. */
export class EncoreService {
  constructor(
    private readonly qloo: QlooClient,
    private readonly qlooStore: Pick<QlooStore, "requestsFor">,
    private readonly app: AppStore,
    private readonly model: JsonModel,
    private readonly agent: Pick<EncoreAgent, "ask">,
  ) {}

  createResident(input: { birthYear: number; grewUp?: string; livesIn?: string; favorites: Favorite[] }): Resident {
    return this.app.createResident(input);
  }

  /** Each visitor gets a private copy of a demo resident. */
  copyDemoResident(demoId: string): Resident | undefined {
    const demo = demoResident(demoId);
    if (!demo) return undefined;
    return this.app.createResident({ birthYear: demo.birthYear, grewUp: demo.grewUp, livesIn: demo.livesIn, demoId: demo.id, favorites: demo.favorites });
  }

  view(residentId: string): ResidentView | undefined {
    const resident = this.app.getResident(residentId);
    if (!resident) return undefined;
    return {
      resident,
      favorites: this.app.favorites(residentId).filter((favorite) => favorite.source === "family"),
      reactions: this.app.reactions(residentId),
      exclusions: this.app.exclusions(residentId),
      visitKits: this.app.visitKitsFor(residentId),
    };
  }

  private async box(resident: Resident, scope: string): Promise<MemoryBox> {
    const favorites = this.app.favorites(resident.id).filter((favorite) => favorite.source === "family");
    const plan = planFromReactions(this.app.reactions(resident.id), this.app.exclusions(resident.id));
    return buildMemoryBox(
      this.qloo,
      { birthYear: resident.birthYear, favorites, pinned: plan.pinned, exclude: { entityIds: plan.excludedEntityIds, tagIds: plan.excludedTagIds } },
      scope,
    );
  }

  async memoryBox(residentId: string): Promise<(MemoryBox & { whatQlooSaw: LoggedRequest[] }) | undefined> {
    const resident = this.app.getResident(residentId);
    if (!resident) return undefined;
    const scope = scopeFor("box");
    const box = await this.box(resident, scope);
    return { ...box, whatQlooSaw: this.qlooStore.requestsFor(scope) };
  }

  /**
   * Records a staff reaction. Reactions stay in Encore's database; Qloo only ever sees the
   * resulting exclusion IDs or extra favorite IDs. A distressing item comes back with similar
   * themes staff may also choose to avoid; nothing is widened without asking.
   */
  async react(residentId: string, input: { entityId: string; value: ReactionValue; item: MemoryItem }) {
    const resident = this.app.getResident(residentId);
    if (!resident) return undefined;
    const reaction = this.app.addReaction(residentId, {
      entityId: input.entityId,
      value: input.value,
      item: {
        name: input.item.name,
        kind: input.item.kind,
        year: input.item.interpretation.year,
        ...(input.item.qloo.notableSongs ? { notableSongs: input.item.qloo.notableSongs } : {}),
      },
    });
    if (input.value !== "distressed") return { reaction, similarThemes: [] };
    const themes = (await tagsFor(this.qloo, input.item, scopeFor("tags"))).slice(0, 4).map((tag) => ({ id: tag.id, name: tag.name }));
    return { reaction, similarThemes: themes };
  }

  addExclusion(residentId: string, exclusion: Exclusion): boolean {
    if (!this.app.getResident(residentId)) return false;
    this.app.addExclusion(residentId, exclusion);
    return true;
  }

  removeExclusion(residentId: string, target: string): boolean {
    if (!this.app.getResident(residentId)) return false;
    this.app.removeExclusion(residentId, target);
    return true;
  }

  async compare(residentId: string): Promise<{ columns: ComparisonColumn[]; whatQlooSaw: LoggedRequest[] } | undefined> {
    const resident = this.app.getResident(residentId);
    if (!resident) return undefined;
    const scope = scopeFor("compare");
    const favorites = this.app.favorites(residentId).filter((favorite) => favorite.source === "family");
    // The comparison uses the family intake only, without learned reactions, so all three see the same input.
    const box = await buildMemoryBox(this.qloo, { birthYear: resident.birthYear, favorites }, scope);
    const columns = await compareSystems(
      this.qloo,
      this.model,
      { birthYear: resident.birthYear, favorites, ...(resident.grewUp ? { grewUp: resident.grewUp } : {}), ...(resident.livesIn ? { livesIn: resident.livesIn } : {}) },
      box,
      scope,
    );
    return { columns, whatQlooSaw: this.qlooStore.requestsFor(scope) };
  }

  async createVisitKit(residentId: string, language: Language) {
    const resident = this.app.getResident(residentId);
    if (!resident) return undefined;
    const scope = scopeFor("kit");
    const box = await this.box(resident, scope);
    const picks = visitPicks(box);
    const { starters } = await conversationStarters(this.qloo, this.model, picks, language, scope);
    const content = visitKitContent(box, picks, starters, language);
    const kit = this.app.createVisitKit(residentId, language, content);
    return { token: kit.token, expiresAt: kit.expiresAt, content, whatQlooSaw: this.qlooStore.requestsFor(scope) };
  }

  /** Public: no resident ID or names in the response. */
  visitKit(token: string): { content: VisitKitContent; expiresAt: string } | undefined {
    const kit = this.app.getVisitKit(token);
    return kit ? { content: kit.content as VisitKitContent, expiresAt: kit.expiresAt } : undefined;
  }

  revokeVisitKit(residentId: string, hint: string): boolean {
    return this.app.revokeVisitKit(residentId, hint);
  }

  async ask(residentId: string, question: string) {
    const resident = this.app.getResident(residentId);
    if (!resident) return undefined;
    const favorites = this.app.favorites(residentId);
    const scope = scopeFor("ask");
    // Ground the agent in the person's Memory Box (cached), so it reasons over checked picks.
    const box = await this.box(resident, scope);
    const picks = box.sections
      .map((section) => `${section.kind}: ${section.items.slice(0, 8).map((item) => `${item.name}${item.interpretation.year ? ` (${item.interpretation.year})` : ""}`).join(", ")}`)
      .join("\n");
    const context = [
      `Born ${resident.birthYear}; their youth (ages 10–30) is ${resident.birthYear + 10}–${resident.birthYear + 30}.`,
      `Confirmed favorites (Qloo IDs): ${favorites.map((favorite) => `${favorite.name} [${favorite.kind}] = ${favorite.entityId}`).join("; ")}.`,
      `Memory Box picks:\n${picks}`,
    ].join("\n");
    const answer = await this.agent.ask(question, scope, context);
    return { ...answer, whatQlooSaw: this.qlooStore.requestsFor(scope) };
  }

  /** A setlist for a visiting musician playing for the demo care home's residents. */
  async groupSession(demoIds: string[] = DEMO_RESIDENTS.map((resident) => resident.id)): Promise<GroupPlan & { members: Array<{ id: string; label: string }> }> {
    const residents = demoIds.map(demoResident).filter((resident): resident is DemoResident => Boolean(resident));
    const scope = scopeFor("group");
    const members: GroupMember[] = await Promise.all(
      residents.map(async (resident) => {
        const box = await buildMemoryBox(this.qloo, { birthYear: resident.birthYear, favorites: resident.favorites }, scope);
        const music = box.sections.find((section) => section.kind === "music")?.items ?? [];
        return {
          id: resident.id,
          label: resident.label,
          items: music
            .filter((item) => item.interpretation.band !== "too_late")
            .map((item) => ({ entityId: item.entityId, name: item.name, year: item.interpretation.year, ...(item.qloo.notableSongs?.[0] ? { song: item.qloo.notableSongs[0] } : {}) })),
        };
      }),
    );
    const plan = planGroupSession(members, { size: 12, minPerMember: 2 });
    return { ...plan, members: members.map((member) => ({ id: member.id, label: member.label })) };
  }

  /** Warms the caches for every demo resident so judges never wait on a cold request. */
  async prewarm(log: (message: string) => void): Promise<void> {
    for (const demo of DEMO_RESIDENTS) {
      const scope = scopeFor("prewarm");
      const box = await buildMemoryBox(this.qloo, { birthYear: demo.birthYear, favorites: demo.favorites }, scope);
      await compareSystems(this.qloo, this.model, { birthYear: demo.birthYear, grewUp: demo.grewUp, livesIn: demo.livesIn, favorites: demo.favorites }, box, scope);
      await conversationStarters(this.qloo, this.model, visitPicks(box), "en", scope);
      log(`prewarmed ${demo.id}`);
    }
    await this.groupSession();
    log("prewarmed group session");
  }
}
