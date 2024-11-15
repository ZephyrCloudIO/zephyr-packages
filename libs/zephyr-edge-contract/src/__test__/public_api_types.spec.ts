import type {
  PublishRequest,
  StageZeroPublishRequest,
  PublishTarget,
  ZeEnvs,
  ZeUploadBuildStats,
  ZephyrPluginOptions,
  Snapshot,
  SnapshotAsset,
  SnapshotMetadata,
  ZeApplicationList,
  ZeAppVersion,
  ZeAppVersionResponse,
  ConvertedGraph,
  LocalPackageJson,
  ZephyrBuildStats,
  Asset,
  SnapshotUploadRes,
  Source,
  UploadableAsset,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZeUploadAssetsOptions,
  FindTemplates,
} from '../index';

describe('type exports', () => {
  test('should export PublishRequest type', () => {
    type TestPublishRequest = PublishRequest;
    const obj: TestPublishRequest = {} as TestPublishRequest;
    expect(obj).toBeDefined();
  });

  test('should export StageZeroPublishRequest type', () => {
    type TestStageZeroPublishRequest = StageZeroPublishRequest;
    const obj: TestStageZeroPublishRequest = {} as TestStageZeroPublishRequest;
    expect(obj).toBeDefined();
  });

  test('should export PublishTarget type', () => {
    type TestPublishTarget = PublishTarget;
    const obj: TestPublishTarget = {} as TestPublishTarget;
    expect(obj).toBeDefined();
  });

  test('should export ZeEnvs type', () => {
    type TestZeEnvs = ZeEnvs;
    const obj: TestZeEnvs = {} as TestZeEnvs;
    expect(obj).toBeDefined();
  });

  test('should export ZeUploadBuildStats type', () => {
    type TestZeUploadBuildStats = ZeUploadBuildStats;
    const obj: TestZeUploadBuildStats = {} as TestZeUploadBuildStats;
    expect(obj).toBeDefined();
  });

  test('should export ZephyrPluginOptions type', () => {
    type TestZephyrPluginOptions = ZephyrPluginOptions;
    const obj: TestZephyrPluginOptions = {} as TestZephyrPluginOptions;
    expect(obj).toBeDefined();
  });

  test('should export Snapshot type', () => {
    type TestSnapshot = Snapshot;
    const obj: TestSnapshot = {} as TestSnapshot;
    expect(obj).toBeDefined();
  });

  test('should export SnapshotAsset type', () => {
    type TestSnapshotAsset = SnapshotAsset;
    const obj: TestSnapshotAsset = {} as TestSnapshotAsset;
    expect(obj).toBeDefined();
  });

  test('should export SnapshotMetadata type', () => {
    type TestSnapshotMetadata = SnapshotMetadata;
    const obj: TestSnapshotMetadata = {} as TestSnapshotMetadata;
    expect(obj).toBeDefined();
  });

  test('should export ZeApplicationList type', () => {
    type TestZeApplicationList = ZeApplicationList;
    const obj: TestZeApplicationList = {} as TestZeApplicationList;
    expect(obj).toBeDefined();
  });

  test('should export ZeAppVersion type', () => {
    type TestZeAppVersion = ZeAppVersion;
    const obj: TestZeAppVersion = {} as TestZeAppVersion;
    expect(obj).toBeDefined();
  });

  test('should export ZeAppVersionResponse type', () => {
    type TestZeAppVersionResponse = ZeAppVersionResponse;
    const obj: TestZeAppVersionResponse = {} as TestZeAppVersionResponse;
    expect(obj).toBeDefined();
  });

  test('should export ConvertedGraph type', () => {
    type TestConvertedGraph = ConvertedGraph;
    const obj: TestConvertedGraph = {} as TestConvertedGraph;
    expect(obj).toBeDefined();
  });

  test('should export LocalPackageJson type', () => {
    type TestLocalPackageJson = LocalPackageJson;
    const obj: TestLocalPackageJson = {} as TestLocalPackageJson;
    expect(obj).toBeDefined();
  });

  test('should export ZephyrBuildStats type', () => {
    type TestZephyrBuildStats = ZephyrBuildStats;
    const obj: TestZephyrBuildStats = {} as TestZephyrBuildStats;
    expect(obj).toBeDefined();
  });

  test('should export Asset type', () => {
    type TestAsset = Asset;
    const obj: TestAsset = {} as TestAsset;
    expect(obj).toBeDefined();
  });

  test('should export SnapshotUploadRes type', () => {
    type TestSnapshotUploadRes = SnapshotUploadRes;
    const obj: TestSnapshotUploadRes = {} as TestSnapshotUploadRes;
    expect(obj).toBeDefined();
  });

  test('should export Source type', () => {
    type TestSource = Source;
    const obj: TestSource = {} as TestSource;
    expect(obj).toBeDefined();
  });

  test('should export UploadableAsset type', () => {
    type TestUploadableAsset = UploadableAsset;
    const obj: TestUploadableAsset = {} as TestUploadableAsset;
    expect(obj).toBeDefined();
  });

  test('should export ZeBuildAsset type', () => {
    type TestZeBuildAsset = ZeBuildAsset;
    const obj: TestZeBuildAsset = {} as TestZeBuildAsset;
    expect(obj).toBeDefined();
  });

  test('should export ZeBuildAssetsMap type', () => {
    type TestZeBuildAssetsMap = ZeBuildAssetsMap;
    const obj: TestZeBuildAssetsMap = {} as TestZeBuildAssetsMap;
    expect(obj).toBeDefined();
  });

  test('should export ZeUploadAssetsOptions type', () => {
    type TestZeUploadAssetsOptions = ZeUploadAssetsOptions;
    const obj: TestZeUploadAssetsOptions = {} as TestZeUploadAssetsOptions;
    expect(obj).toBeDefined();
  });

  test('should export FindTemplates type', () => {
    type TestFindTemplates = FindTemplates<string>;
    const obj: TestFindTemplates = {} as TestFindTemplates;
    expect(obj).toBeDefined();
  });
});
