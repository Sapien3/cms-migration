# External links

.....
https://cms.mediatechservice.com | Production cms
https://web.mediatechservice.com | Production front-end
https://test.mediatechservice.com | Staging cms
https://web.test.mediatechservice.com | Staging front-end
https://akhbar.slite.com/app/channels/user-HqI7aMYpKHl-vF | Deployment docs
front-end-github-repo: ssh://user1@50.28.37.170/home/user1/akhbar-frontend.git
back-end-github-repo: ssh://user1@50.28.37.170/home/user1/akhbar-cms.git

# Strapi application

A quick description of your strapi application

# al-akbhar-admin

CMS admin website for AL-AKHBAR

# setup

Goto Settings > Roles > Public

To allow public access to controller method for serving s3 images, check on s3assets:

- Attachment
- Serve

# Overwritten plugins

Added preview button above InformationCard

extensions/content-manager/admin/src/containers/EditView/index.js
`

```
import Button from './Button';

```

```
{(layouts['application::article.article']) && (<Button onClick={handleClick}>
  Preview Article
</Button>)}
  <InformationCard />
```

Added autosave

extensions/content-manager/admin/src/containers/EditViewDataManagerProvider/index.js

installation:

```
npm i --save @use-it/interval
```

```
import useInterval from '@use-it/interval';
```

```
useInterval(function() {
  console.debug('autosave');
  const { draftAndPublish } = allLayoutData.contentType.schema.options;
  // const modifiedData = state.modifiedData;
  const data = modifiedData;
  let published = data.published_at !== undefined && data.published_at !== null
  if ('published_at' in modifiedData) {
    published = modifiedData.published_at !== undefined && modifiedData.published_at !== null
  }
  const modified = !isEqual(initialData, modifiedData);

  if (! isCreatingEntry && modified && draftAndPublish && ! published) {
    console.debug('saving...');
    handleSubmit(document.createEvent('HTMLEvents'));
  }
}, 60 * 1000);
```

before:

```
return (
    <EditViewDataManagerContext.Provider
    ...
)
```

## fix slow query for admin dropdown

```
find(params, model, populate) {
  console.debug('find', params, model, 'populate', populate);
  const limit = params._limit || 20
  const start = params._start || 0
  // console.debug('section.find', ctx.query, params, ctx.request.body);
  // console.debug('query2', strapi.query(model).model);
  return strapi.query(model).model.query((qb) => {
    qb.debug(true);
    for (let field in params._where) {
      ...

```

## Editted SelectMany to avoid huge list handling in admin especially Section > Articles

```
//extensions/content-manager/admin/src/components/SelectMany/index.js

<>
  {!isEmpty(value) && value.length > 1000 && <div>List too huge (disabled)</div>}
  {isEmpty(value) || (value.length < 1000) && <Select
  ...

  <ListWrapper ref={drop}>
    {!isEmpty(value) && value.length <= 1000 && (

```

## making short url and link fields always disabled in collection type (article) because they're generated automatically and should not be edited

extensions/content-manager/admin/src/components/Inputs/index.js

```
const label = metadatas.label;
if (
  (collectionType === "application::article.article" && label === "ShortURL") ||
  label === "Link"
) return true;
```

Note: the prop collectionType is customely added in the component
extensions/content-manager/admin/src/container/EditView/index.js

```
  <Inputs
    autoFocus={
      blockIndex === 0 &&
      fieldsBlockIndex === 0 &&
      fieldIndex === 0
    }
    fieldSchema={fieldSchema}
    keys={name}
    metadatas={metadatas}
    collectionType={layout.contentType.uid}
  />
```

and the checkbox option to disable or enable input in configure view is removed
extensions/content-manager/admin/src/container/EditSettingsView/index.js

```
if (
      mainLayout.uid === "application::article.article" &&
      (metaToEdit === "link" || metaToEdit === "ShortURL") &&
      meta === "editable"
    ) {
      return null;
    }
```

## making only pdf uploadable in collection type (Edition)

for changes read README.md in extensions/upload
