import fs from 'fs';
import { Project, SyntaxKind } from 'ts-morph';

// add syntax type for code ordering
const leadingTypes = [
  SyntaxKind.ImportDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.InterfaceDeclaration,
].reverse(); // reverse here for easier sorting

const trailingTypes = [
  SyntaxKind.ExportDeclaration,
  SyntaxKind.ExportAssignment,
];

// define way to bind comments to code
// (assume comments are "attached" to next code statement)
const commentKinds = [
  SyntaxKind.SingleLineCommentTrivia,
  SyntaxKind.MultiLineCommentTrivia,
];
const getNonCommentStatement = (statement, index, statements) => {
  return commentKinds.includes(statement.getKind())
    ? statements
        .slice(index)
        .find((statement) => !commentKinds.includes(statement.getKind())) ??
        statement
    : statement;
};

export default async function main() {
  // set up TS-morph project
  const project = new Project({
    compilerOptions: {
      ...JSON.parse(fs.readFileSync('./tsconfig.json')).compilerOptions,
      moduleResolution: undefined,
    },
  });

  // collect generated files
  const sourceFiles = project.addSourceFilesAtPaths(
    'src/lib/web3/generated/ts-client/**/*.ts'
  );

  // loop through each generated file
  sourceFiles.forEach((sourceFile) => {
    // order code statements with attached comments into top and bottom sections
    sourceFile
      .getStatementsWithComments()
      // add extra "kind" property to attach comments to next code block
      .map((statement, index, statements) => {
        statement.___kind = getNonCommentStatement(
          statement,
          index,
          statements
        )?.getKind();
        return statement;
      })
      // move leading types to the front in order
      .sort((a, b) => {
        return (
          leadingTypes.indexOf(b.___kind) - leadingTypes.indexOf(a.___kind)
        );
      })
      // move trailing types to the back in order
      .sort((a, b) => {
        return (
          trailingTypes.indexOf(a.___kind) - trailingTypes.indexOf(b.___kind)
        );
      })
      // set the new order in the file
      .forEach((statement, index) => {
        if (statement.getChildIndex() !== index) {
          statement.setOrder(index);
        }
      });

    // use TypeScript organizeImports for consistent imports
    // https://ts-morph.com/details/source-files#organizing-imports
    // https://devblogs.microsoft.com/typescript/announcing-typescript-2-8-2/#organize-imports
    sourceFile.organizeImports();

    // order Type statements
    orderStatementsLexically(
      sourceFile.getStatementsWithComments(),
      (statement) => !!statement.isKind(SyntaxKind.TypeAliasDeclaration)
    );

    // order Interface statements
    orderStatementsLexically(
      sourceFile.getStatementsWithComments(),
      (statement) => !!statement.isKind(SyntaxKind.InterfaceDeclaration)
    );

    // order "properties" of export declarations
    const exportLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ExportDeclaration
    );
    exportLiterals.forEach((exportLiteral) => {
      if (exportLiteral.hasNamedExports()) {
        const namedExports = exportLiteral.getNamedExports();
        const sortedNamedExports = namedExports.sort((a, b) =>
          a.getName().localeCompare(b.getName())
        );
        const sortedText = sortedNamedExports.map((namedExport) =>
          namedExport.getFullText()
        );
        const [, startSpace = ' ', endSpace = ' '] =
          exportLiteral.getText().match(/^export +\{(\s*).*?(\s*)\}$/s) || [];
        exportLiteral.replaceWithText(
          `export {${startSpace}${sortedText
            .map((text) => text.replace(/^ *(.*) *$/s, '$1'))
            .join(', ')}${endSpace}}`
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n\n\n+/, '\n\n')
        );
      }
    });

    // order properties of object literals: `{ ... }`
    const objectLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ObjectLiteralExpression
    );
    // go in reverse order so that inner objects of objects are transformed first
    objectLiterals.reverse().forEach((objectLiteral) => {
      // get properties
      const properties = objectLiteral.getPropertiesWithComments();
      // get sortable sections, ie. don't mess up the order of spread statements
      const sortedPropertySections = properties
        .reduce(
          (sections, property) => {
            if (
              [SyntaxKind.SpreadAssignment, SyntaxKind.SpreadElement].includes(
                property.getKind()
              )
            ) {
              return [...sections, [property], []];
            }
            const lastSection = sections.pop();
            return [...sections, [...lastSection, property]];
          },
          [[]]
        )
        // sort each sortable section
        .map((section) =>
          section.sort((a, b) => {
            return a.getName().localeCompare(b.getName());
          })
        );

      // get text of sorted properties
      const sortedProperties = sortedPropertySections.flat();
      const sortedText = sortedProperties
        .map((property) => property.getFullText())
        // strip spaces (but not line breaks) from ends of properties
        .map((text) => text.replace(/^ *(.*) *$/s, '$1'));
      const [, startSpace = ' ', endSpace = ' '] =
        objectLiteral.getText().match(/^\{(\s*).*?(\s*)\}$/s) || [];
      // replace object statement with newly ordered code
      objectLiteral.replaceWithText(
        `{${startSpace}${sortedText.join(', ')}${endSpace}}`
          // clean up trailing spaces
          .replace(/[ \t]+\n/g, '\n')
          // clean up multiple lines
          .replace(/\n\n\n+/g, '\n\n')
      );
    });

    // ensure consistent ordering of exported message types for each module
    if (sourceFile.getFilePath().endsWith('/registry.ts')) {
      // get vars to work with
      const arrayDeclaration = sourceFile.getVariableDeclaration('msgTypes');
      const arrayLiteral = arrayDeclaration.getFirstDescendantByKind(
        SyntaxKind.ArrayLiteralExpression
      );
      const arrayLiteralExpressions = arrayLiteral.getDescendantsOfKind(
        SyntaxKind.ArrayLiteralExpression
      );
      const sortedArrayLiteralExpressions = arrayLiteralExpressions
        .slice()
        .sort((a, b) => a.getText().localeCompare(b.getText()));

      // get text of sorted items
      const sortedText = sortedArrayLiteralExpressions
        .map((node) => node.getFullText())
        // strip spaces (but not line breaks) from ends of properties
        .map((text) => text.replace(/^ *(.*) *$/s, '$1'));
      const [, startSpace = ' ', endSpace = ' '] =
        arrayLiteral.getText().match(/^\[(\s*).*?(\s*)\]$/s) || [];
      arrayLiteral.replaceWithText(
        `[${startSpace}${sortedText.join(', ')}${endSpace}]`
          // clean up trailing spaces
          .replace(/[ \t]+\n/g, '\n')
          // clean up multiple lines
          .replace(/\n+/g, '\n')
      );
    }

    // disable linting for these files
    sourceFile.insertStatements(
      0,
      '/* eslint-disable */\n/* tslint:disable */\n'
    );
  });

  function orderStatementsLexically(statements, predicateFilter) {
    // get statemenets that match the predicate filter
    const filteredStatements = statements.filter(
      (statement, index, statements) => {
        const nextNonCommentStatement = getNonCommentStatement(
          statement,
          index,
          statements
        );
        return predicateFilter(nextNonCommentStatement);
      }
    );
    // get indexes of these statements
    const filteredStatementIndexes = filteredStatements.map((s) =>
      s.getChildIndex()
    );
    // find new ordering of these statements
    const sortedStatements = filteredStatements.sort((a, b) => {
      // sort by code statement text (not comment text)
      const aText = getNonCommentStatement(
        a,
        filteredStatements.indexOf(a),
        filteredStatements
      ).getText();
      const bText = getNonCommentStatement(
        b,
        filteredStatements.indexOf(b),
        filteredStatements
      ).getText();
      return aText.localeCompare(bText);
    });
    // set the new ordering into the previous indexes list
    sortedStatements.forEach((statement, index) => {
      statement.setOrder(filteredStatementIndexes[index]);
    });
  }

  // save changes
  await project.save();
}
