type ManifestFlowEntry = {
  path: string;
  contentHash: string;
  // Tags carried by the flow at the time of the pull. Optional because it is
  // absent both on pre-tags manifests and on flows the tag fetch skipped —
  // `Manifest.tagsFetchedAt` distinguishes those from a genuinely untagged flow.
  tags: string[] | undefined;
};

// Identifies a flow run against a pulled env: derived by walking the
// flow file's absolute path up to a `.qawolf/<env>/` ancestor and
// resolving the manifest entry by relative path. Carried on
// FlowRunResult and the reporter's onFlowPass/onFlowFail events.
export type FlowStamp = {
  envId: string;
  path: string;
  contentHash: string;
};

export type Manifest = {
  envId: string;
  envSlug: string | undefined;
  fetchedAt: string;
  envVarsFetchedAt: string | undefined;
  cliFlowsVersion: string;
  // Bundle-source provenance, populated independently:
  //   qawolfCommitSha    — parsed from the tarball wrapper directory's name
  //                        (`<owner>-<repo>-<sha>`); undefined when the
  //                        wrapper is missing or has no trailing 40-hex
  //                        segment.
  //   qawolfCommittedAt  — sampled from any flow file's preserved mtime
  //                        (GitHub-archive bundles share one commit-time
  //                        mtime across all entries); undefined only when
  //                        the bundle has no flow files.
  //
  // The two can disagree on presence: e.g., a bundle with flows but a
  // non-conformant wrapper name will set qawolfCommittedAt and leave
  // qawolfCommitSha undefined.
  qawolfCommitSha: string | undefined;
  qawolfCommittedAt: string | undefined;
  // When the tag fetch last succeeded for this env. Undefined means tags were
  // never fetched, so tag queries cannot be answered from this manifest at all
  // — distinct from a fetch that succeeded and found no tags on a flow.
  tagsFetchedAt: string | undefined;
  flows: ManifestFlowEntry[];
};
