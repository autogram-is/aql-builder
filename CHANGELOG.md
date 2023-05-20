# Changelog

## 0.5.6 - 18-Apr-2023

- Removing or changing the name of the COUNT variable works
- A 'join' shortcut for ID comparison between two document variables can be used instead of the clunkier equality syntax: `{ path: '_id', eq: 'edge._from', value: 'dynamic' }` becomes `{ path: '_id', join: 'edge._from' }`;

## 0.5.5 - 16-Apr-2023

- Fixed 'limit' being applied before 'sort'
