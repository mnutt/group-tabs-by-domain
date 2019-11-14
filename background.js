const TST_ID = 'treestyletab@piro.sakura.ne.jp';

// Operate _only_ on the current window, or on all windows, merging all windows'
// tabs into the current window?
const MERGE_ALL_WINDOWS_TOGETHER = false;

async function groupTabs() {
  let opts = {};

  if (!MERGE_ALL_WINDOWS_TOGETHER) {
    const currentWindow = await browser.windows.getCurrent();
    opts = { windowId: currentWindow.id };
  }

  let tabs = await browser.tabs.query(opts);

  tabs.forEach(t => {
    try {
      const url = new URL(t.url);
      t.domain = url.hostname;
    } catch(e) {
      // do nothing with bad URLs
    }
  });

  tabs = tabs
    .filter(t => !t.pinned) // don't mess with pinned tabs
    .filter(t => !t.url || !t.url.match(/^moz-extension:/)) // don't reorganize groups
    .filter(t => t.domain && t.domain.length); // maybe couldn't parse URL for some reason

  console.log(`Got ${tabs.length} tabs.`);

  const groups = groupBy(tabs, 'domain');

  const groupsWithMultiple = Object.entries(groups).filter(g => g[1].length > 1);

  // Sort smallest-to-largest, because we are inserting at top and want to eventually
  // have the largest groups at the top
  groupsWithMultiple.sort((a, b) => a[1].length - b[1].length);

  // Not doing anything with this yet
  const individualTabs = Object.values(groups).filter(g => g.length === 1).map(tabs => tabs[0]);

  for (let [domain, group] of groupsWithMultiple) {
    console.log("Group", domain, group.length, group.map(t => t.id));

    for (let tab of group) {
      // await browser.runtime.sendMessage(TST_ID, {
      //   type: 'detach',
      //   tab:  tab.id
      // });

      // Place all tabs at the beginning so that the group ends up there
      await browser.runtime.sendMessage(TST_ID, {
        type: 'move-to-start',
        tab: tab.id
      });

      await sleep(100);
    }

    console.log('next');

    // This succeeds, but returns an error asynchronously so fire-and-forget
    browser.runtime.sendMessage(TST_ID, {
      type: 'group-tabs',
      tabs: group.map(t => t.id)
    });

    // Hack: wait for the previous command to finish
    await sleep(1000);
  }

  console.log("Finished");
}

// (async () => {
//   let success = await browser.runtime.sendMessage(TST_ID, {
//     type: 'register-self',
//     name: 'Group Tabs By Domain',
//     icons: browser.runtime.getManifest().icons,
//     permissions: ['tabs']
//   });

//   console.log(success);
// })();

function listener() {
  // So that our async method logs errors to console
  groupTabs().catch(e => console.error(e));
}

function groupBy(xs, key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

browser.browserAction.onClicked.addListener(listener);
