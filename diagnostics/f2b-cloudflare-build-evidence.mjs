const ACCOUNT="9c1807c68493f14259248b5f5782cc6f";
const API="https://api.cloudflare.com/client/v4";
const BUILD="a92850ff-7781-4165-8162-e18945e1f3d9";
const COMMIT="b570ffb5f70c43501e8997de1d7b5d42dab7cc2e";
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token) throw new Error("credential-not-configured");
const response=await fetch(`${API}/accounts/${ACCOUNT}/builds/builds/${BUILD}`,{
  headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
  signal:AbortSignal.timeout(30000),
});
const body=await response.json();
const r=body?.result??null;
const metadata=r?.build_trigger_metadata??{};
const out={
  httpStatus:response.status,
  success:response.ok&&body?.success!==false,
  buildId:BUILD,
  buildOutcome:r?.build_outcome??null,
  createdOn:r?.created_on??null,
  modifiedOn:r?.modified_on??null,
  previewUrl:r?.preview_url??null,
  branch:metadata.branch??null,
  commitHash:metadata.commit_hash??null,
  triggerSource:metadata.build_trigger_source??null,
  buildCommand:metadata.build_command??null,
  deployCommand:metadata.deploy_command??null,
  rootDirectory:metadata.root_directory??null,
};
console.log("F2B_BUILD_EVIDENCE "+JSON.stringify(out));
if(!out.success||out.buildOutcome!=="success"||out.commitHash!==COMMIT) process.exit(1);
