/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Rule to prefer isNullish over manual checking for undefined or null.
 */

import { cond, find, map, matches, property } from "lodash-es";
import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESTree,
} from "@typescript-eslint/utils";
import type { RemedaMethodVisitors } from "../types";
import astUtil from "../util/astUtil";
import { getDocsUrl } from "../util/getDocsUrl";
import { getRemedaContext, isCallToRemedaMethod } from "../util/remedaUtil";

const { isNegationExpression, isEquivalentMemberExp } = astUtil;

interface ExpressionNode {
  type: string;
  operator: unknown;
  right: unknown;
  left: unknown;
}

export const RULE_NAME = "prefer-is-nullish";
const PREFER_IS_NULLISH_MESSAGE =
  "Prefer isNullish over checking for undefined or null.";

type MessageIds = "prefer-is-nullish";
type Options = [];

// function isLogicalOrUnaryExpression(
//   node: TSESTree.Node,
// ): node is TSESTree.LogicalExpression | TSESTree.UnaryExpression {
//   return (
//     node.type === AST_NODE_TYPES.LogicalExpression ||
//     node.type === AST_NODE_TYPES.UnaryExpression
//   );
// }

export default ESLintUtils.RuleCreator(getDocsUrl)<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "enforce R.isNullish over checks for both null and undefined.",
      url: getDocsUrl(RULE_NAME),
    },
    schema: [],
    messages: {
      "prefer-is-nullish": PREFER_IS_NULLISH_MESSAGE,
    },
  },
  defaultOptions: [],
  create(context) {
    const remedaContext = getRemedaContext(context);

    function getRemedaTypeCheckedBy(typecheck: string) {
      // @ts-expect-error
      return function (node) {
        return (
          // @ts-expect-error
          isCallToRemedaMethod(node, typecheck, remedaContext) &&
          node.arguments[0]
        );
      };
    }

    const getTypeofArgument = cond([
      [
        matches({ type: "UnaryExpression", operator: "typeof" }),
        property("argument"),
      ],
    ]);

    const isUndefinedString = matches({
      type: "Literal",
      value: "undefined",
    });

    function getValueWithTypeofUndefinedComparison(
      node: ExpressionNode,
      operator: unknown,
    ) {
      return (
        node.type === "BinaryExpression" &&
        node.operator === operator &&
        ((isUndefinedString(node.right) && getTypeofArgument(node.left)) ||
          (isUndefinedString(node.left) && getTypeofArgument(node.right)))
      );
    }

    const nilChecksIsValue = {
      null: matches({ type: "Literal", value: null }),
      undefined: matches({ type: "Identifier", name: "undefined" }),
    };

    function getValueComparedTo(nil: "null" | "undefined") {
      return function (node: ExpressionNode, operator: unknown) {
        return (
          node.type === "BinaryExpression" &&
          node.operator === operator &&
          ((nilChecksIsValue[nil](node.right) && node.left) ||
            (nilChecksIsValue[nil](node.left) && node.right))
        );
      };
    }

    const nilChecksExpressionChecks = {
      null: [getRemedaTypeCheckedBy("isNull"), getValueComparedTo("null")],
      undefined: [
        getRemedaTypeCheckedBy("isUndefined"),
        getValueComparedTo("undefined"),
        getValueWithTypeofUndefinedComparison,
      ],
    };

    function checkExpression(
      nil: "null" | "undefined",
      operator: string,
      node: { type: string; operator: unknown; right: unknown; left: unknown },
    ) {
      const mappedValues = map(nilChecksExpressionChecks[nil], (check) =>
        check(node, operator),
      );

      return find(mappedValues);
    }

    function checkNegatedExpression(
      nil: "null" | "undefined",
      node: TSESTree.LogicalExpression | TSESTree.UnaryExpression,
    ) {
      return (
        (isNegationExpression(node) &&
          // @ts-expect-error
          checkExpression(nil, "===", node.argument)) ||
        // @ts-expect-error
        checkExpression(nil, "!==", node)
      );
    }

    function isEquivalentExistingExpression(
      node: TSESTree.LogicalExpression | TSESTree.UnaryExpression,
      leftNil: "null" | "undefined",
      rightNil: "null" | "undefined",
    ) {
      if (node.type !== AST_NODE_TYPES.LogicalExpression) {
        return false;
      }
      // @ts-expect-error
      const leftExp = checkExpression(leftNil, "===", node.left);

      return (
        leftExp &&
        isEquivalentMemberExp(
          leftExp,
          // @ts-expect-error
          checkExpression(rightNil, "===", node.right),
        )
      );
    }

    function isEquivalentExistingNegation(
      node: TSESTree.LogicalExpression | TSESTree.UnaryExpression,
      leftNil: "null" | "undefined",
      rightNil: "null" | "undefined",
    ) {
      // @ts-expect-error
      const leftExp = checkNegatedExpression(leftNil, node.left);

      return (
        leftExp &&
        isEquivalentMemberExp(
          leftExp,
          // @ts-expect-error
          checkNegatedExpression(rightNil, node.right),
        )
      );
    }

    const visitors: RemedaMethodVisitors = remedaContext.getImportVisitors();

    visitors.LogicalExpression = function (node: TSESTree.LogicalExpression) {
      if (node.operator === "||") {
        if (
          isEquivalentExistingExpression(node, "undefined", "null") ||
          isEquivalentExistingExpression(node, "null", "undefined")
        ) {
          context.report({
            node,
            messageId: "prefer-is-nullish",
          });
        }
      } else if (
        isEquivalentExistingNegation(node, "undefined", "null") ||
        isEquivalentExistingNegation(node, "null", "undefined")
      ) {
        context.report({
          node,
          messageId: "prefer-is-nullish",
        });
      }
    };

    return visitors;
  },
});
