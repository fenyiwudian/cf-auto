/**
 * 获取url中的queryParams
 * @returns {{}}
 */
export const getQueryParam = () => {
  const search = location.search;
  if (!search) {
    return {};
  }
  const searches = search.substr(1).split("&");
  const pair = {};
  searches.forEach( (str) => {
    const split = str.split("=");
    pair[decodeURIComponent(split[0])] = decodeURIComponent(split[1]);
  });
  return pair;
};